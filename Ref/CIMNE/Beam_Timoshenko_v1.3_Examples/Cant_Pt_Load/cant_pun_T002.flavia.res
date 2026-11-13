Gid Post Results File 1.0 
### 
# MAT-fem Timoshenko Beam v1.3 
# 
GaussPoints "GPTR" Elemtype Linear 
Number of Gauss Points: 2 
Natural Coordinates: Internal 
end gausspionts 
# 
Result "Displacement" "Load Analysis"  1  Vector OnNodes 
ComponentNames "X-Displ", "Y-Displ", "Z-Displ" 
Values 
     1 0.0 -7.07784e-005 0.0  
     2 0.0 -2.21335e-005 0.0  
     3 0.0         00000 0.0  
End Values 
# 
Result "Rotation" "Load Analysis"  1  Vector OnNodes 
ComponentNames "X-Rot", "Y-Rot", "Z-Rot" 
Values 
     1 0.0 0.0 -1.06045e-005 
     2 0.0 0.0 -7.95340e-006 
     3 0.0 0.0         00000 
End Values 
# 
Result "Reaction Force" "Load Analysis"  1  Vector OnNodes 
ComponentNames "X-Force", "Y-Force", "Z-Force" 
Values 
     1 0.0         00000 0.0  
     2 0.0         00000 0.0  
     3 0.0  5.00000e+000 0.0  
End Values 
# 
Result "Reaction Moment" "Load Analysis"  1  Vector OnNodes 
ComponentNames "X-Moment", "Y-Moment", "Z-Moment" 
Values 
     1 0.0 0.0         00000 
     2 0.0 0.0         00000 
     3 0.0 0.0  5.00000e+001 
End Values 
# 
Result "Moment and Shear" "Load Analysis"  1  Vector OnNodes 
ComponentNames "Mz", "Qy", "Zero" 
Values 
     1 -2.26230e-001  -5.00000e+000  0.0 
     2 -4.52460e-001  -5.00000e+000  0.0 
     3 -6.78690e-001  -5.00000e+000  0.0 
End Values 
