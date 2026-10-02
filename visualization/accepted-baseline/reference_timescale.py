"""Independent NumPy/analytic checks for the bounded browser CWT, not a benchmark."""
from pathlib import Path
import argparse
import importlib.util
import json
import subprocess
import numpy as np

ROOT = Path(__file__).resolve().parent


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--node', required=True)
    args = parser.parse_args()
    # Node provides actual outputs only. This file generates its own input values,
    # frequency grid, complex kernels, convolution, and analytic expectations.
    script = "const T=require('./timescale.js');console.log(JSON.stringify(['chirp','sinusoid','constant'].map(k=>{const r=T.analyze(T.makeCalibration(k));return {id:k,real:r.real,imag:r.imag,frequencies:r.frequencies_hz};}).concat([(()=>{const r=T.analyze(T.makeCalibration('chirp'),{mode:'prefix',asOfIndex:512});return {id:'chirp_prefix',real:r.real,imag:r.imag,frequencies:r.frequencies_hz};})()])));"
    actuals = json.loads(subprocess.run([args.node, '-e', script], cwd=ROOT, check=True, capture_output=True, text=True).stdout)
    fs, count, B, C = 128.0, 1024, 1.5, 1.0
    t = np.arange(count) / fs
    inputs = {'chirp': np.sin(2*np.pi*(6*t+1.25*t*t)), 'sinusoid': np.sin(2*np.pi*12*t), 'constant': np.ones(count)}
    inputs['chirp_prefix'] = inputs['chirp'][:513]
    frequencies = 4*np.power(8.0, np.arange(48)/47)
    scales = C*fs/frequencies
    rows = []
    analytic_error = 0.0
    constant_error = 0.0
    for item in actuals:
        x = inputs[item['id']]
        actual = np.array(item['real']) + 1j*np.array(item['imag'])
        reference = np.empty((len(scales), len(x)), dtype=complex)
        for j, a in enumerate(scales):
            radius = int(np.floor(8*a))
            offsets = np.arange(-radius, radius+1)
            u = offsets / a
            # np.convolve reverses the second operand. The positive exponent
            # here therefore yields conjugate(psi((n-b)/a)) in the sum.
            kernel = np.exp(-u*u/B) * np.exp(2j*np.pi*C*u) / np.sqrt(np.pi*B*a)
            reference[j] = np.convolve(x, kernel, mode='full')[radius:radius+len(x)]
            if item['id'] == 'sinusoid':
                b = np.arange(radius, len(x)-radius)
                positive = np.exp(-np.pi**2*B*(a*12/fs-C)**2)
                negative = np.exp(-np.pi**2*B*(a*12/fs+C)**2)
                analytic = np.sqrt(a)/(2j) * (np.exp(2j*np.pi*12*b/fs)*positive - np.exp(-2j*np.pi*12*b/fs)*negative)
                analytic_error = max(analytic_error, float(np.max(np.abs(actual[j,b]-analytic))))
            if item['id'] == 'constant':
                # Integral of this uncorrected complex Morlet is exp(-pi² B C²).
                analytic = np.sqrt(a)*np.exp(-np.pi**2*B*C*C)
                constant_error = max(constant_error, float(np.max(np.abs(actual[j,radius:len(x)-radius]-analytic))))
        error = float(np.max(np.abs(actual-reference)))
        denominator = max(1.0, float(np.max(np.abs(reference))))
        normalized = error/denominator
        frequency_error = float(np.max(np.abs(np.array(item['frequencies'])-frequencies)))
        assert normalized <= 1e-10, (item['id'], normalized)
        assert frequency_error <= 1e-12, (item['id'], frequency_error)
        rows.append({'signal': item['id'], 'sample_count': len(x), 'coefficient_count': int(actual.size), 'max_absolute_complex_error': error, 'normalized_max_absolute_complex_error': normalized, 'normalized_error_tolerance': 1e-10, 'max_frequency_hz_error': frequency_error})
    assert analytic_error <= 1e-10, analytic_error
    assert constant_error <= 1e-10, constant_error
    output = {
        'contract_version': 'calibration-cwt/1', 'implementation_version': 'cmor-sampled-convolution/1',
        'reference': {'implementation': 'independent NumPy complex kernel convolution and analytic controls', 'numpy_version': np.__version__, 'pywavelets_installed': importlib.util.find_spec('pywt') is not None, 'pywavelets_used': False, 'sample_normalization': True, 'source_equations_generated_independently': True},
        'passed': True, 'comparisons': rows,
        'analytic_controls': {'sinusoid_unpadded_max_absolute_complex_error': analytic_error, 'constant_unpadded_max_absolute_complex_error': constant_error, 'absolute_error_tolerance': 1e-10, 'qualification': 'Infinite-domain analytic responses; selected scales make discrete aliases and truncated tails negligible at the stated tolerance.'},
        'scope': 'Synthetic calibration implementation controls only; not CANON efficacy, a queue transform, or a new benchmark.'
    }
    (ROOT/'timescale_reference_results.json').write_text(json.dumps(output, indent=2)+'\n', encoding='utf-8')
    print(json.dumps(output, indent=2))


if __name__ == '__main__':
    main()
